module.exports = {
  apps: [
    {
      name: 'hopebridge',
      script: '/opt/productionapp/dist/workers/location-processors/hopebridge-processor.js'
    },
    {
      name: 'hopebridge-factory',
      script: '/opt/productionapp/dist/workers/logic-factories/hopebridge-logic-factory.js'
    }
  ]
};
