const { MongoClient } = require("mongodb");
(async () => {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  const client = new MongoClient(uri);
  await client.connect();
  const coll = client.db(dbName).collection("service_activity");
  const docs = await coll.find({ serviceId: 2, note: "customer contacted" }).sort({ createdAt: 1 }).toArray();
  console.log(JSON.stringify({ count: docs.length, ids: docs.map(d => d._id.toString()), createdAt: docs.map(d => d.createdAt ? d.createdAt.toISOString() : null) }));
  if (docs.length > 1) {
    const keepId = docs[0]._id;
    const deleteIds = docs.slice(1).map(d => d._id);
    const result = await coll.deleteMany({ _id: { $in: deleteIds } });
    console.log(JSON.stringify({ deleted: result.deletedCount, kept: keepId.toString() }));
  }
  await client.close();
})();
