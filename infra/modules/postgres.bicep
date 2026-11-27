param serverName string
param location string
param tags object

@description('Resource ID of the virtual network, for the private DNS zone link.')
param vnetId string

@description('Resource ID of the subnet delegated to PostgreSQL Flexible Server.')
param subnetId string

param administratorLogin string

@secure()
param administratorPassword string

param databaseName string = 'campaigns'

@allowed(['16', '17'])
param postgresVersion string = '16'

// The server name resolves to a private IP only inside VNets linked to this zone.
resource dnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: '${serverName}.private.postgres.database.azure.com'
  location: 'global'
  tags: tags
}

resource dnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: dnsZone
  name: 'link-${serverName}'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
}

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: postgresVersion
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
    storage: {
      storageSizeGB: 32
      autoGrow: 'Disabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    // Private access: the server gets an IP in the delegated subnet and no public endpoint.
    network: {
      delegatedSubnetResourceId: subnetId
      privateDnsZoneArmResourceId: dnsZone.id
    }
  }
  // The DNS zone must be linked to the VNet before the server is created.
  dependsOn: [
    dnsLink
  ]
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: server
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

output name string = server.name
output fqdn string = server.properties.fullyQualifiedDomainName
output databaseName string = database.name