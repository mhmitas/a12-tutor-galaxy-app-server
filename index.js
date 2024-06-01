const express = require('express')
const app = express()
require('dotenv').config()
const port = process.env.PORT || 5000;


app.get('/', (req, res) => {
    res.send('Welcome to the TutorGalaxy')
})



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jt5df8u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const database = client.db('study_platform_db');
        const userColl = database.collection('users');

        // user related APIs -----------
        // save user in db
        app.post('/user', async (req, res) => {
            const user = req.body;
            console.log(user)
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.listen(port, () => {
    console.log(`TutorGalaxy app is listening on PORT: ${port}`)
})