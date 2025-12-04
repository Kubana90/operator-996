#!/usr/bin/env python3
"""
operator-996 Deployment CLI
Advanced deployment orchestration tool

Usage:
    python deploy_cli.py deploy --env dev
    python deploy_cli.py rollback --env prod --revision 3
    python deploy_cli.py status --env stage
"""

import argparse
import subprocess
import sys
import os
import json
import time
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass
from pathlib import Path


@dataclass
class DeploymentConfig:
    """Deployment configuration"""
    environment: str
    namespace: str
    values_file: str
    replicas: int
    timeout: str
    image_tag: Optional[str] = None


class Colors:
    """Terminal colors"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


class DeploymentCLI:
    """Main deployment CLI class"""

    ENVIRONMENTS = {
        'dev': DeploymentConfig(
            environment='dev',
            namespace='operator996-dev',
            values_file='infra/helm/operator996/values-dev.yaml',
            replicas=1,
            timeout='10m'
        ),
        'stage': DeploymentConfig(
            environment='stage',
            namespace='operator996-stage',
            values_file='infra/helm/operator996/values-stage.yaml',
            replicas=2,
            timeout='15m'
        ),
        'prod': DeploymentConfig(
            environment='prod',
            namespace='operator996-prod',
            values_file='infra/helm/operator996/values-prod.yaml',
            replicas=3,
            timeout='20m'
        )
    }

    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.project_root = Path(__file__).parent.parent

    def log(self, message: str, color: str = Colors.OKBLUE):
        """Print colored log message"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"{color}[{timestamp}] {message}{Colors.ENDC}")

    def run_command(self, command: List[str], check: bool = True) -> subprocess.CompletedProcess:
        """Execute shell command"""
        if self.verbose:
            self.log(f"Executing: {' '.join(command)}", Colors.OKCYAN)
        
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False
        )
        
        if self.verbose or result.returncode != 0:
            if result.stdout:
                print(result.stdout)
            if result.stderr:
                print(result.stderr, file=sys.stderr)
        
        if check and result.returncode != 0:
            raise RuntimeError(f"Command failed with exit code {result.returncode}")
        
        return result

    def validate_prerequisites(self):
        """Check required tools are installed"""
        self.log("Checking prerequisites...", Colors.HEADER)
        
        tools = ['kubectl', 'helm', 'docker']
        missing = []
        
        for tool in tools:
            result = self.run_command(['which', tool], check=False)
            if result.returncode != 0:
                missing.append(tool)
        
        if missing:
            self.log(f"Missing required tools: {', '.join(missing)}", Colors.FAIL)
            sys.exit(1)
        
        self.log("All prerequisites met ✓", Colors.OKGREEN)

    def deploy(self, config: DeploymentConfig, dry_run: bool = False):
        """Deploy to specified environment"""
        self.log(f"Starting deployment to {config.environment}...", Colors.HEADER)
        
        # Build Helm command
        helm_cmd = [
            'helm', 'upgrade', '--install', 'operator996',
            str(self.project_root / 'infra' / 'helm' / 'operator996'),
            '--namespace', config.namespace,
            '--create-namespace',
            '--values', str(self.project_root / config.values_file),
            '--wait',
            '--timeout', config.timeout
        ]
        
        if config.image_tag:
            helm_cmd.extend(['--set', f'image.tag={config.image_tag}'])
        
        if dry_run:
            helm_cmd.append('--dry-run')
            self.log("Running in DRY-RUN mode", Colors.WARNING)
        
        # Execute deployment
        try:
            self.run_command(helm_cmd)
            self.log(f"Deployment to {config.environment} successful ✓", Colors.OKGREEN)
            
            # Show status
            if not dry_run:
                self.show_status(config)
        
        except RuntimeError as e:
            self.log(f"Deployment failed: {e}", Colors.FAIL)
            sys.exit(1)

    def rollback(self, config: DeploymentConfig, revision: Optional[int] = None):
        """Rollback deployment"""
        self.log(f"Rolling back {config.environment}...", Colors.WARNING)
        
        rollback_cmd = [
            'helm', 'rollback', 'operator996',
            '--namespace', config.namespace,
            '--wait'
        ]
        
        if revision:
            rollback_cmd.append(str(revision))
        
        try:
            self.run_command(rollback_cmd)
            self.log(f"Rollback successful ✓", Colors.OKGREEN)
            self.show_status(config)
        
        except RuntimeError as e:
            self.log(f"Rollback failed: {e}", Colors.FAIL)
            sys.exit(1)

    def show_status(self, config: DeploymentConfig):
        """Show deployment status"""
        self.log(f"Status for {config.environment}:", Colors.HEADER)
        
        # Get deployment status
        self.run_command([
            'kubectl', 'get', 'deployments',
            '-n', config.namespace,
            '-l', 'app.kubernetes.io/name=operator996'
        ], check=False)
        
        # Get pods
        self.run_command([
            'kubectl', 'get', 'pods',
            '-n', config.namespace,
            '-l', 'app.kubernetes.io/name=operator996'
        ], check=False)
        
        # Get services
        self.run_command([
            'kubectl', 'get', 'services',
            '-n', config.namespace
        ], check=False)

    def show_history(self, config: DeploymentConfig):
        """Show deployment history"""
        self.log(f"Deployment history for {config.environment}:", Colors.HEADER)
        
        self.run_command([
            'helm', 'history', 'operator996',
            '--namespace', config.namespace
        ], check=False)

    def show_logs(self, config: DeploymentConfig, tail: int = 100):
        """Show application logs"""
        self.log(f"Logs for {config.environment} (last {tail} lines):", Colors.HEADER)
        
        self.run_command([
            'kubectl', 'logs',
            '-n', config.namespace,
            '-l', 'app.kubernetes.io/name=operator996',
            '--tail', str(tail),
            '--all-containers=true'
        ], check=False)

    def scale(self, config: DeploymentConfig, replicas: int):
        """Scale deployment"""
        self.log(f"Scaling {config.environment} to {replicas} replicas...", Colors.HEADER)
        
        self.run_command([
            'kubectl', 'scale', 'deployment', 'operator996',
            '-n', config.namespace,
            f'--replicas={replicas}'
        ])
        
        self.log(f"Scaling successful ✓", Colors.OKGREEN)

    def run_tests(self, config: DeploymentConfig):
        """Run smoke tests"""
        self.log(f"Running smoke tests for {config.environment}...", Colors.HEADER)
        
        # Health check
        self.run_command([
            'kubectl', 'run', 'smoke-test',
            '--image=curlimages/curl:latest',
            '--rm', '-i', '--restart=Never',
            '-n', config.namespace,
            '--',
            'curl', '-f', f'http://operator996.{config.namespace}.svc.cluster.local:3000/health'
        ], check=False)
        
        self.log("Smoke tests completed ✓", Colors.OKGREEN)


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description='operator-996 Deployment CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')
    
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Deploy command
    deploy_parser = subparsers.add_parser('deploy', help='Deploy application')
    deploy_parser.add_argument('--env', required=True, choices=['dev', 'stage', 'prod'],
                              help='Target environment')
    deploy_parser.add_argument('--tag', help='Image tag to deploy')
    deploy_parser.add_argument('--dry-run', action='store_true', help='Dry run mode')
    
    # Rollback command
    rollback_parser = subparsers.add_parser('rollback', help='Rollback deployment')
    rollback_parser.add_argument('--env', required=True, choices=['dev', 'stage', 'prod'])
    rollback_parser.add_argument('--revision', type=int, help='Revision to rollback to')
    
    # Status command
    status_parser = subparsers.add_parser('status', help='Show deployment status')
    status_parser.add_argument('--env', required=True, choices=['dev', 'stage', 'prod'])
    
    # History command
    history_parser = subparsers.add_parser('history', help='Show deployment history')
    history_parser.add_argument('--env', required=True, choices=['dev', 'stage', 'prod'])
    
    # Logs command
    logs_parser = subparsers.add_parser('logs', help='Show application logs')
    logs_parser.add_argument('--env', required=True, choices=['dev', 'stage', 'prod'])
    logs_parser.add_argument('--tail', type=int, default=100, help='Number of lines')
    
    # Scale command
    scale_parser = subparsers.add_parser('scale', help='Scale deployment')
    scale_parser.add_argument('--env', required=True, choices=['dev', 'stage', 'prod'])
    scale_parser.add_argument('--replicas', type=int, required=True, help='Number of replicas')
    
    # Test command
    test_parser = subparsers.add_parser('test', help='Run smoke tests')
    test_parser.add_argument('--env', required=True, choices=['dev', 'stage', 'prod'])
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    cli = DeploymentCLI(verbose=args.verbose)
    cli.validate_prerequisites()
    
    config = DeploymentCLI.ENVIRONMENTS[args.env]
    
    if hasattr(args, 'tag') and args.tag:
        config.image_tag = args.tag
    
    # Execute command
    try:
        if args.command == 'deploy':
            cli.deploy(config, dry_run=args.dry_run)
        elif args.command == 'rollback':
            cli.rollback(config, revision=args.revision)
        elif args.command == 'status':
            cli.show_status(config)
        elif args.command == 'history':
            cli.show_history(config)
        elif args.command == 'logs':
            cli.show_logs(config, tail=args.tail)
        elif args.command == 'scale':
            cli.scale(config, replicas=args.replicas)
        elif args.command == 'test':
            cli.run_tests(config)
    
    except KeyboardInterrupt:
        print("\n" + Colors.WARNING + "Operation cancelled by user" + Colors.ENDC)
        sys.exit(1)
    except Exception as e:
        print(f"{Colors.FAIL}Error: {e}{Colors.ENDC}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
