param name string
param location string
param tags object

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false // access only through Entra ID / managed identity, no shared password
  }
}

output id string = registry.id
output name string = registry.name
output loginServer string = registry.properties.loginServer
