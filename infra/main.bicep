targetScope = 'resourceGroup'

@description('Environment name, used in resource names and tags.')
@allowed(['dev'])
param env string = 'dev'

@description('Azure region for all resources. Defaults to the resource group region.')
param location string = resourceGroup().location

@description('Owner tag value.')
param owner string

@description('PostgreSQL administrator login.')
param postgresAdminLogin string = 'campaignsadmin'

@secure()
@description('PostgreSQL administrator password. Passed at deploy time, never committed.')
param postgresAdminPassword string

var project = 'campaigns'
// Short deterministic suffix for globally unique names (ACR, Key Vault).
var suffix = take(uniqueString(resourceGroup().id), 6)
var tags = {
  project: project
  env: env
  owner: owner
}

module logs 'modules/log-analytics.bicep' = {
  name: 'logs'
  params: {
    name: 'log-${project}-${env}'
    location: location
    tags: tags
  }
}

module network 'modules/network.bicep' = {
  name: 'network'
  params: {
    name: 'vnet-${project}-${env}'
    location: location
    tags: tags
  }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    serverName: 'psql-${project}-${env}-${suffix}'
    location: location
    tags: tags
    vnetId: network.outputs.id
    subnetId: network.outputs.dbSubnetId
    administratorLogin: postgresAdminLogin
    administratorPassword: postgresAdminPassword
  }
}

module registry 'modules/container-registry.bicep' = {
  name: 'registry'
  params: {
    name: 'acr${project}${env}${suffix}'
    location: location
    tags: tags
  }
}

module containerAppsEnv 'modules/container-apps-env.bicep' = {
  name: 'containerAppsEnv'
  params: {
    name: 'cae-${project}-${env}'
    location: location
    tags: tags
    logAnalyticsWorkspaceName: logs.outputs.name
    infrastructureSubnetId: network.outputs.appsSubnetId
  }
}

output registryLoginServer string = registry.outputs.loginServer
output containerAppsEnvironmentId string = containerAppsEnv.outputs.id
output postgresHost string = postgres.outputs.fqdn
output postgresDatabase string = postgres.outputs.databaseName