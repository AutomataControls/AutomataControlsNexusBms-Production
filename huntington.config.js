module.exports = {
  apps: [
    {
      name: 'huntington',
      script: '/opt/productionapp/dist/workers/location-processors/huntington-processor.js'
    },
    {
      name: 'huntington-factory', 
      script: '/opt/productionapp/dist/workers/logic-factories/huntington-logic-factory.js'
    }
  ]
};
