const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000;


// middlewares
app.use(cors({
    origin: ['http://localhost:5173', 'https://tutor-galaxy.web.app', 'https://tutor-galaxy.firebaseapp.com']
}))
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

// verify token middleware
function verifyToken(req, res, next) {
    const token = req.headers?.authorization.split(' ')[1]
    if (!token) {
        return res.status(401).send({ message: 'unauthorize access' })
    }
    jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
        if (err) {
            console.log(err)
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.user = decoded;
        next()
    })
}

async function run() {
    try {
        const database = client.db('study_platform_db');
        const userColl = database.collection('users');
        const studySessionColl = database.collection('study-sessions')
        const materialColl = database.collection('materials')
        const bookingColl = database.collection('bookings')
        const reviewColl = database.collection('reviews')
        const noteColl = database.collection('notes')

        // role verify middlewares:-----------
        // verify tutor middleware
        async function verifyTutor(req, res, next) {
            const tutorEmail = req?.user?.email
            const query = { email: tutorEmail }
            const result = await userColl.findOne(query)
            if (result && result.role === 'tutor') {
                return next()
            } else {
                return res.status(401).send({ message: 'Unauthorized access' })
            }
        }
        // verify student middleware
        async function verifyStudent(req, res, next) {
            const studentEmail = req?.user?.email;
            const query = { email: studentEmail }
            const result = await userColl.findOne(query)
            if (result && result.role === 'student') {
                return next()
            } else {
                return res.status(401).send({ message: 'Unauthorized access | you are not student' })
            }
        }
        // verify admin middleware
        async function verifyAdmin(req, res, next) {
            const adminEmail = req?.user?.email;
            const query = { email: adminEmail }
            const result = await userColl.findOne(query)
            if (result && result.role === 'admin') {
                return next()
            } else {
                return res.status(401).send({ message: 'Unauthorized access | you are not admin' })
            }
        }

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

        // public APIs + session APIs + others----------
        // get study sessions 
        app.get('/study-sessions', async (req, res) => {
            // let query = {};
            let limit = 0
            if (req.query?.limit) {
                limit = parseInt(req.query.limit);
            }
            let sort = { _id: 1 }
            const result = await studySessionColl.find().sort(sort).limit(limit).toArray()
            res.send(result)
        })
        app.get('/study-sessions/detail/:id', async (req, res) => {
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
        // get notes from db
        app.get('/notes/:email', async (req, res) => {
            const email = req.params.email;
            const query = { userEmail: email }
            const sort = { _id: -1 }
            const result = await noteColl.find(query).sort(sort).toArray()
            res.send(result)
        })
        // get a note for update
        app.get('/notes/detail/:id', async (req, res) => {
            const id = req.params?.id;
            console.log(id)
            const query = { _id: new ObjectId(id) }
            const result = await noteColl.findOne(query);
            res.send(result)
        })
        // save note in db
        app.post('/notes', verifyToken, verifyStudent, async (req, res) => {
            const note = req.body
            const result = await noteColl.insertOne(note)
            res.send(result)
        })
        // update a note
        app.patch('/notes/update/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const updateNote = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = { $set: { ...updateNote } }
            const result = await noteColl.updateOne(query, updateDoc)
            res.send(result)
        })
        // delete a note
        app.delete('/notes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await noteColl.deleteOne(query)
            res.send(result)
        })
        // get a sessions material by student
        app.get('/materials/session/:id', async (req, res) => {
            const id = req.params.id
            const query = { sessionId: id }
            const result = await materialColl.find(query).toArray()
            res.send(result)
        })


        // tutor related APIs -----------
        // create study session
        app.get('/study-sessions/tutor/:email', verifyToken, verifyTutor, async (req, res) => {
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
        // update rejected session status 
        app.patch('/study-sessions/update/:id', async (req, res) => {
            const id = req.params.id;
            const updateSession = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = { $set: { ...updateSession }, $unset: { rejection_info: '' } }
            const result = await studySessionColl.updateOne(query, updateDoc)
            res.send(result)
        })
        // delete a session from session coll.
        app.delete('/study-sessions/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const checkResult = await studySessionColl.findOne(query, { projection: { status: 1 } })
            if (checkResult.status === 'approved') {
                return res.status(405).send({ message: 'Method Not Allowed' })
            }
            const result = await studySessionColl.deleteOne(query)
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

        // Admin related APIs
        // get all study session from db
        app.get('/all-sessions', async (req, res) => {
            let limit = 0
            let query = {}
            let sort = { _id: 1 }
            if (req.query?.limit) {
                limit = parseInt(req.query.limit);
            }
            if (req.query?.status) {
                query = { status: req.query.status }
            }
            const result = await studySessionColl.find(query).sort(sort).limit(limit).toArray()
            res.send(result)
        })
        // set registration fee and update status
        app.patch('/study-sessions/update-by-admin/:id', async (req, res) => {
            const id = req.params.id;
            const updateSession = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = { $set: { ...updateSession } }
            const result = await studySessionColl.updateOne(query, updateDoc)
            res.send(result)
        })
        // delete an approved session by admin
        app.delete('/study-sessions/delete-by-admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const checkResult = await studySessionColl.findOne(query, { projection: { status: 1 } })
            if (checkResult.status !== 'approved') {
                return res.status(405).send({ message: 'Method Not Allowed' })
            }
            const result = await studySessionColl.deleteOne(query)
            res.send(result)
        })
        // update an approved session by admin
        app.patch('/study-session/update-by-admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateSession = req.body;
            const updateDoc = { $set: { ...updateSession } }
            const result = await studySessionColl.updateOne(query, updateDoc)
            res.send(result)
        })
        // get all materials from material collection
        app.get('/all-materials', async (req, res) => {
            const result = await materialColl.find().toArray()
            res.send(result)
        })
        // delete materials by admin
        app.delete('/material/delete-by-admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await materialColl.deleteOne(query)
            res.send(result)
        })

        // jwt related APIs
        // generate token when auth stage change
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const secret = process.env.JWT_SECRET
            const token = jwt.sign(user, secret, { expiresIn: '1h' })
            res.send({ token })
        })

        // MUST REMOVE BEFORE DEPLOY
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