#!/usr/bin/env python3
"""
operator-996 Integration Tests
Tests database connectivity, API endpoints, and service integration
"""

import os
import sys
import pytest
import psycopg2
import redis
import requests
import time
from datetime import datetime
from typing import Optional


class TestConfig:
    """Test configuration from environment variables"""
    
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = int(os.getenv('DB_PORT', 5432))
    DB_NAME = os.getenv('DB_NAME', 'operator996_test')
    DB_USER = os.getenv('DB_USER', 'test_user')
    DB_PASSWORD = os.getenv('DB_PASSWORD', 'test_pass')
    
    REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
    REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
    REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', '')
    
    API_URL = os.getenv('API_URL', 'http://localhost:3000')
    API_TIMEOUT = int(os.getenv('API_TIMEOUT', 10))


class TestDatabase:
    """Database integration tests"""
    
    @pytest.fixture
    def db_connection(self):
        """Create database connection"""
        conn = psycopg2.connect(
            host=TestConfig.DB_HOST,
            port=TestConfig.DB_PORT,
            database=TestConfig.DB_NAME,
            user=TestConfig.DB_USER,
            password=TestConfig.DB_PASSWORD
        )
        yield conn
        conn.close()
    
    def test_database_connection(self, db_connection):
        """Test basic database connectivity"""
        cursor = db_connection.cursor()
        cursor.execute('SELECT 1 as test')
        result = cursor.fetchone()
        assert result[0] == 1
        cursor.close()
    
    def test_database_tables_exist(self, db_connection):
        """Verify all required tables exist"""
        cursor = db_connection.cursor()
        
        expected_tables = [
            'users',
            'events',
            'kpis',
            'kpi_measurements',
            'biofeedback_metrics',
            'system_metrics'
        ]
        
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        
        existing_tables = [row[0] for row in cursor.fetchall()]
        
        for table in expected_tables:
            assert table in existing_tables, f"Table {table} does not exist"
        
        cursor.close()
    
    def test_timescaledb_extension(self, db_connection):
        """Verify TimescaleDB extension is enabled"""
        cursor = db_connection.cursor()
        cursor.execute("""
            SELECT extname FROM pg_extension WHERE extname = 'timescaledb'
        """)
        result = cursor.fetchone()
        assert result is not None, "TimescaleDB extension not installed"
        cursor.close()


class TestRedis:
    """Redis integration tests"""
    
    @pytest.fixture
    def redis_client(self):
        """Create Redis connection"""
        client = redis.Redis(
            host=TestConfig.REDIS_HOST,
            port=TestConfig.REDIS_PORT,
            password=TestConfig.REDIS_PASSWORD if TestConfig.REDIS_PASSWORD else None,
            decode_responses=True
        )
        yield client
        client.close()
    
    def test_redis_connection(self, redis_client):
        """Test Redis connectivity"""
        assert redis_client.ping() is True
    
    def test_redis_set_get(self, redis_client):
        """Test basic Redis operations"""
        test_key = f"test:{int(time.time())}"
        test_value = "operator996_test_value"
        
        redis_client.set(test_key, test_value, ex=60)
        retrieved_value = redis_client.get(test_key)
        
        assert retrieved_value == test_value
        
        # Cleanup
        redis_client.delete(test_key)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
