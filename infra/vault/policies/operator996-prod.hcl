# Vault Policy - Production Environment
# operator-996 Platform
# RESTRICTED ACCESS - Production credentials only

# Allow reading secrets for production
path "secret/data/operator996/prod/*" {
  capabilities = ["read"]
}

# Allow reading database credentials (read-only)
path "database/creds/operator996-prod" {
  capabilities = ["read"]
}

# Allow reading Redis credentials
path "secret/data/redis/prod" {
  capabilities = ["read"]
}

# Allow reading JWT secrets
path "secret/data/auth/jwt/prod" {
  capabilities = ["read"]
}

# Allow reading Kong admin token
path "secret/data/kong/prod" {
  capabilities = ["read"]
}

# Allow reading Datadog API key
path "secret/data/datadog/prod" {
  capabilities = ["read"]
}

# Allow reading backup encryption key
path "secret/data/backup/encryption" {
  capabilities = ["read"]
}

# Allow token renewal
path "auth/token/renew-self" {
  capabilities = ["update"]
}

# Allow looking up own token info
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

# Deny access to dev/staging secrets
path "secret/data/operator996/dev/*" {
  capabilities = ["deny"]
}

path "secret/data/operator996/stage/*" {
  capabilities = ["deny"]
}

# Deny writing to any paths
path "secret/data/*" {
  capabilities = ["read"]
}

# Deny metadata operations
path "secret/metadata/*" {
  capabilities = ["deny"]
}
