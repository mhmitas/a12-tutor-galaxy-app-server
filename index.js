const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const port = process.env.PORT || 5000;


// middlewares
app.use(cors())
app.use(express.json())


app.get('/', (req, res) => {
    res.send('Welcome to the TutorGalaxy')
})


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const studySessionColl = database.collection('study-sessions')
        const materialColl = database.collection('materials')
        const bookingColl = database.collection('bookings')
        const reviewColl = database.collection('reviews')
        const noteColl = database.collection('notes')

        // user related APIs -----------
        // save user in db
        app.post('/users', async (req, res) => {
            const user = req.body;
            // checking: does the user already exist in the db?
            const query = { email: user?.email }
            const isExist = await userColl.findOne(query)
            if (isExist) {
                return res.send({ exist: true })
            }
            const result = await userColl.insertOne({ ...user, timeStamp: Date.now() })
            res.send({ result, isExist })
        })

        // public APIs + session APIs + others
        // get study sessions 
        app.get('/study-sessions', async (req, res) => {
            let query = {};
            if (req.query.limit) {
                limit = parseInt(req.query.limit)
                // console.log(limit)
            }
            const result = await studySessionColl.find().limit(limit).toArray()
            res.send(result)
        })
        app.get('/study-sessions/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await studySessionColl.findOne(query)
            res.send(result)
        })
        app.get('/users/role/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await userColl.findOne(query)
            res.send(result)
        })

        // student related APIs ------------
        // book a session
        app.post('/bookings', async (req, res) => {
            const sessionData = req.body;
            const result = await bookingColl.insertOne(sessionData)
            res.send(result)
        })
        // get booked sessions ids
        app.get('/bookings/:email', async (req, res) => {
            const email = req.params?.email;
            const query = { userEmail: email };
            const result = await bookingColl.find(query).toArray()
            res.send(result)
        })
        // get booked sessions ids
        app.get('/bookings/session-ids/:email', async (req, res) => {
            const email = req.params?.email;
            const query = { userEmail: email };
            const options = {
                projection: { _id: 0, sessionId: 1 }
            }
            const result = await bookingColl.find(query, options).toArray()
            const ids = result.map(item => item.sessionId)
            res.send(ids)
        })
        // post review in db
        app.put('/reviews', async (req, res) => {
            const review = req.body;
            const query = { sessionId: review.sessionId, userEmail: review.userEmail }
            const updateDoc = { $set: { ...review } }
            const options = { upsert: true }
            const result = await reviewColl.updateOne(query, updateDoc, options);
            res.send(result)
        })
        // get all reviews
        app.get('/reviews/:sessionId', async (req, res) => {
            const sessionId = req.params.sessionId;
            const query = { sessionId: sessionId }
            const result = await reviewColl.find(query).toArray()
            res.send(result)
        })
        // get note from db
        app.get('/notes/:email', async (req, res) => {
            const email = req.params.email;
            const query = { userEmail: email }
            const result = await noteColl.find(query).toArray()
            res.send(result)
        })
        // save note in db
        app.post('/notes', async (req, res) => {
            const note = req.body
            const result = await noteColl.insertOne(note)
            res.send(result)
        })
        app.delete('/notes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await noteColl.deleteOne(query)
            res.send(result)
        })


        // tutor related APIs -----------
        // create study session
        app.get('/study-sessions/tutor/:email', async (req, res) => {
            const email = req.params?.email;
            let query = { tutor_email: email }
            if (req.query.status) {
                query = { ...query, status: req.query.status }
            }
            const result = await studySessionColl.find(query).toArray()
            res.send(result)
        })
        app.post('/study-sessions', async (req, res) => {
            const sessionInfo = req.body;
            const result = await studySessionColl.insertOne(sessionInfo)
            res.send(result)
        })
        app.patch('/study-sessions/update/:id', async (req, res) => {
            const id = req.params.id;
            const updateSession = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = { $set: { ...updateSession } }
            const result = await studySessionColl.updateOne(query, updateDoc)
            res.send(result)
        })
        // delete a session from session coll.
        app.delete('/study-sessions/delete/:id', async (req, res) => {
            const id = req.params.id
            const result = await studySessionColl.deleteOne({ _id: new ObjectId(id) })
            res.send(result)
        })
        // upload study materials
        app.post('/materials', async (req, res) => {
            const materials = req.body
            const result = await materialColl.insertOne(materials)
            res.send(result)
        })
        // get all materials added by tutor
        app.get('/materials/tutor/:email', async (req, res) => {
            const email = req.params?.email;
            let query = { tutor_email: email }
            const result = await materialColl.find(query).toArray()
            res.send(result)
        })
        // update a material in material coll.
        app.patch('/materials/update/:id', async (req, res) => {
            const id = req.params.id;
            const material = req.body;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = { $set: { ...material } }
            const result = await materialColl.updateOne(filter, updateDoc)
            res.send(result)
        })
        // delete a material from material coll.
        app.delete('/materials/delete/:id', async (req, res) => {
            const id = req.params.id
            const result = await materialColl.deleteOne({ _id: new ObjectId(id) })
            res.send(result)
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