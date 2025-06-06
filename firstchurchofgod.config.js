module.exports = {
  apps: [
    {
      name: 'firstchurchofgod',
      script: '/opt/productionapp/dist/workers/location-processors/firstchurchofgod-processor.js'
    },
    {
      name: 'firstchurchofgod-factory',
      script: '/opt/productionapp/dist/workers/logic-factories/firstchurchofgod-logic-factory.js'
    }
  ]
};
