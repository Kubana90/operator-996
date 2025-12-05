# Vault Policy - Development Environment
# operator-996 Platform

# Allow reading secrets for development
path "secret/data/operator996/dev/*" {
  capabilities = ["read", "list"]
}

# Allow reading database credentials
path "database/creds/operator996-dev" {
  capabilities = ["read"]
}

# Allow reading Redis credentials
path "secret/data/redis/dev" {
  capabilities = ["read"]
}

# Allow reading JWT secrets
path "secret/data/auth/jwt/dev" {
  capabilities = ["read"]
}

# Allow reading Kong admin token
path "secret/data/kong/dev" {
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
