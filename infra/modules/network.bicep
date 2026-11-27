param name string
param location string
param tags object

@description('Address space of the virtual network.')
param addressPrefix string = '10.10.0.0/16'

@description('Subnet for the Container Apps environment (workload profiles need at least /27).')
param appsSubnetPrefix string = '10.10.0.0/24'

@description('Subnet for PostgreSQL Flexible Server (at least /28).')
param dbSubnetPrefix string = '10.10.1.0/24'

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        addressPrefix
      ]
    }
    subnets: [
      {
        name: 'snet-apps'
        properties: {
          addressPrefix: appsSubnetPrefix
          delegations: [
            {
              name: 'containerapps'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
      {
        name: 'snet-db'
        properties: {
          addressPrefix: dbSubnetPrefix
          delegations: [
            {
              name: 'postgres'
              properties: {
                serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
              }
            }
          ]
        }
      }
    ]
  }
}

output id string = vnet.id
output name string = vnet.name
output appsSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, 'snet-apps')
output dbSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, 'snet-db')