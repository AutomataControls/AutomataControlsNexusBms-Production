module.exports = {
  apps: [
    {
      name: 'ne-realty',
      script: '/opt/productionapp/dist/workers/location-processors/ne-realty-processor.js'
    },
    {
      name: 'ne-realty-factory',
      script: '/opt/productionapp/dist/workers/logic-factories/ne-realty-logic-factory.js'
    }
  ]
};
