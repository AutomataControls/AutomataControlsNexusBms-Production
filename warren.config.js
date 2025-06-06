module.exports = {
  apps: [
    {
      name: 'warren',
      script: '/opt/productionapp/dist/workers/location-processors/warren-processor.js'
    },
    {
      name: 'warren-factory',
      script: '/opt/productionapp/dist/workers/logic-factories/warren-logic-factory.js'
    }
  ]
};
