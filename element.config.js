module.exports = {
  apps: [
    {
      name: 'element',
      script: '/opt/productionapp/dist/workers/location-processors/element-processor.js'
    },
    {
      name: 'element-factory',
      script: '/opt/productionapp/dist/workers/logic-factories/element-logic-factory.js'
    }
  ]
};
