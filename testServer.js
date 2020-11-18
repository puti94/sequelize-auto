/**
 * User: puti.
 * Time: 2020-05-14 00:20.
 */
const express = require("express");
const { Sequelize } = require("sequelize");
const { ApolloServer } = require("apollo-server-express");
const { AutoSequelize } = require("./lib");
const { generateSchema } = require("graphql-adapter");
const app = express();
const sequelize = new Sequelize("mysql://test:123456@localhost:3306/testdb");

const PORT = 4132;
app.listen({ port: PORT }, () => {
  }
);
new AutoSequelize(sequelize, { additional: { timestamps: false } }).prepare()
  .then((auto) => {
    auto.initModels();
    // auto.sequelize.models.websites.hasMany(auto.sequelize.models.accessLog, { foreignKey: "siteId" });
    // auto.sequelize.models.accessLog.hasOne(auto.sequelize.models.websites, {
    //   sourceKey: "siteId",
    //   foreignKey: "id",
    //   as: "site"
    // });
    const server = new ApolloServer({
      schema: generateSchema(auto.sequelize.models, { includeSubscription: false, includeMetadata: false })
    });
    server.applyMiddleware({ app, path: "/test" });
    console.log(`🚀 Subscriptions ready at http://localhost:${PORT}${server.graphqlPath}`);
  });
