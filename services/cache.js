const mongoose = require("mongoose");
const util = require("util");
const redis = require("redis");

const redisUrl = "redis://127.0.0.1:6379";
const client = redis.createClient(redisUrl);

client.hget = util.promisify(client.hget);

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || "");
  return this;
};

mongoose.Query.prototype.exec = async function () {
  if (!this.useCache) {
    return exec.apply(this, arguments);
  }

  // make key using collection name and getQuery()
  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name,
    })
  );

  // get the key in redis
  const cacheValue = await client.hget(this.hashKey, key);

  if (cacheValue) {
    console.log("SERVED FROM cache");
    const doc = JSON.parse(cacheValue);

    return Array.isArray(doc)
      ? doc.map((d) => new this.model(d))
      : new this.model(doc);
  }

  // otherwise issue the query & store the result in redis

  const result = await exec.apply(this, arguments);
  console.log("SERVED from query");

  client.hset(this.hashKey, key, JSON.stringify(result), "EX", 10);

  return result;
};

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  },
};
