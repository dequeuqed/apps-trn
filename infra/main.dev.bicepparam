using 'main.bicep'

param env = 'dev'
param owner = 'ivan'

param postgresAdminPassword = readEnvironmentVariable('PG_ADMIN_PASSWORD')