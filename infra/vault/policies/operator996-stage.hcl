# Vault Policy - Staging Environment
# operator-996 Platform

# Allow reading secrets for staging
path "secret/data/operator996/stage/*" {
  capabilities = ["read", "list"]
}

# Allow reading database credentials
path "database/creds/operator996-stage" {
  capabilities = ["read"]
}

# Allow reading Redis credentials
path "secret/data/redis/stage" {
  capabilities = ["read"]
}

# Allow reading JWT secrets
path "secret/data/auth/jwt/stage" {
  capabilities = ["read"]
}

# Allow reading Kong admin token
path "secret/data/kong/stage" {
  capabilities = ["read"]
}

# Allow reading Datadog API key
path "secret/data/datadog/stage" {
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

# Deny access to production secrets
path "secret/data/operator996/prod/*" {
  capabilities = ["deny"]
}
