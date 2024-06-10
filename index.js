const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.STRIPE_SK)
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
// const uri = `mongodb://localhost:27017`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true,
    }
});

// verify token middleware
function verifyToken(req, res, next) {
    const token = req.headers?.authorization?.split(' ')[1]
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
        userColl.createIndex({ name: "text", email: "text" })
        const studySessionColl = database.collection('study-sessions')
        const materialColl = database.collection('materials')
        const bookingColl = database.collection('bookings')
        const reviewColl = database.collection('reviews')
        const noteColl = database.collection('notes')
        const announcementColl = database.collection('announcements')

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
        // get user : main purpose getting role
        app.get('/users/role/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await userColl.findOne(query)
            res.send(result)
        })
        // update user profile
        app.patch('/api/user/update-profile/:email', async (req, res) => {
            const email = req.params.email
            const updateUser = req.body
            const query = { email: email }
            const updateDoc = {
                $set: {
                    name: updateUser?.name,
                    image: updateUser?.image,
                    address: updateUser?.address,
                    phone: updateUser?.phone,
                }
            }
            const result = await userColl.updateOne(query, updateDoc)
            res.send(result)
        })

        // public APIs + session APIs + others----------
        // get study sessions 
        app.get('/study-sessions', async (req, res) => {
            // let query = {};
            let limit = 0
            if (req.query?.limit) { limit = parseInt(req.query.limit) }
            let sort = { _id: -1 }
            let query = { status: req.query?.status }
            if (req.query?.status) {
                query = { status: req.query.status }
            }
            const result = await studySessionColl.find(query).sort(sort).limit(limit).toArray()
            res.send(result);
        })
        // get all study sessions 
        app.get('/all-study-sessions', async (req, res) => {
            // console.log(req.query)
            let pageNum = parseInt(req.query.page) || 0;
            let limit = parseInt(req.query.limit) || 10;
            let skip = limit * pageNum;
            let query = { status: req.query?.status }
            const sort = { _id: -1 }
            const result = await studySessionColl.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .toArray()
            res.send(result);
        })
        app.get('/study-sessions/detail/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await studySessionColl.findOne(query)
            res.send(result)
        })
        // get total sessions count
        app.get('/total-sessions', async (req, res) => {
            const result = await studySessionColl.countDocuments({ status: 'approved' })
            res.send({ totalSessions: result })
        })
        // get tutors
        app.get('/api/home/tutors', async (req, res) => {
            const query = { role: 'tutor' }
            const result = await userColl.find(query).toArray()
            res.send(result)
        })
        // get announcements
        app.get('/announcements', async (req, res) => {
            const result = await announcementColl.find().sort({ _id: -1 }).toArray()
            res.send(result)
        })
        // get all reviews(api for verified users)
        app.get('/reviews/:sessionId', async (req, res) => {
            const sessionId = req.params.sessionId;
            const query = { sessionId: sessionId };
            let limit = 6
            let sort = { _id: -1 }
            const result = await reviewColl.find(query).sort(sort).limit(limit).toArray()
            res.send(result)
        })


        // student related APIs ------------
        // book a session
        app.post('/bookings', verifyToken, verifyStudent, async (req, res) => {
            const sessionData = req.body;
            const result = await bookingColl.insertOne(sessionData)
            res.send(result)
        })
        // get booked sessions
        app.get('/bookings/:email', verifyToken, verifyStudent, async (req, res) => {
            const email = req.params?.email;
            const query = { userEmail: email };
            let limit = 0;
            if (req.query?.limit) { limit = parseInt(req.query.limit) }
            let sort = { _id: -1 }
            const result = await bookingColl.find(query).limit(limit).sort(sort).toArray()
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
        app.put('/reviews', verifyToken, verifyStudent, async (req, res) => {
            const review = req.body;
            const query = { sessionId: review.sessionId, userEmail: review.userEmail }
            const updateDoc = { $set: { ...review } }
            const options = { upsert: true }
            const result = await reviewColl.updateOne(query, updateDoc, options);
            res.send(result)
        })
        // get notes from db
        app.get('/notes/:email', verifyToken, verifyStudent, async (req, res) => {
            const email = req.params.email;
            const query = { userEmail: email }
            const sort = { _id: -1 }
            const result = await noteColl.find(query).sort(sort).toArray()
            res.send(result)
        })
        // get a note for update
        app.get('/notes/detail/:id', async (req, res) => {
            const id = req.params?.id;
            // console.log(id)
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
        app.patch('/notes/update/:id', verifyToken, verifyStudent, async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const updateNote = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = { $set: { ...updateNote } }
            const result = await noteColl.updateOne(query, updateDoc)
            res.send(result)
        })
        // delete a note
        app.delete('/notes/:id', verifyToken, verifyStudent, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await noteColl.deleteOne(query)
            res.send(result)
        })
        // get a sessions material by student
        app.get('/materials/session/:id', verifyToken, verifyStudent, async (req, res) => {
            const id = req.params.id
            const query = { sessionId: id }
            const result = await materialColl.find(query).toArray()
            res.send(result)
        })
        // get classmates
        app.get('/bookings/all-students/:id', verifyToken, verifyStudent, async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const query = { sessionId: id }
            const options = { projection: { userEmail: 1, _id: 0 } }
            const result = await bookingColl.find(query, options).toArray()
            // get all emails
            const emails = result.map(obj => obj.userEmail)
            const filter = { email: { $in: emails } }
            const usersResult = await userColl.find(filter).toArray()
            res.send(usersResult)
        })


        // tutor: related APIs -----------
        // get tutors sessions
        app.get('/study-sessions/tutor/:email', verifyToken, verifyTutor, async (req, res) => {
            const email = req.params?.email;
            let query = { tutor_email: email }
            if (req.query?.status) {
                query = { ...query, status: req.query.status }
            }
            let limit = 0
            let skip = 0
            if (req.query.limit) {
                limit = parseInt(req.query.limit)
            }
            if (req.query.skip) {
                skip = parseInt(req.query.skip)
            }
            const result = await studySessionColl.find(query).limit(limit).skip(skip).sort({ _id: -1 }).toArray()
            res.send(result)
        })
        // get total session count
        app.get('/study-sessions/tutor/count/:email', verifyToken, verifyTutor, async (req, res) => {
            const email = req.params?.email;
            const query = { tutor_email: email, status: 'approved' }
            const total = await studySessionColl.countDocuments(query)
            res.send({ total })
        })
        // post an session to db
        app.post('/study-sessions', verifyToken, verifyTutor, async (req, res) => {
            const sessionInfo = req.body;
            const result = await studySessionColl.insertOne(sessionInfo)
            res.send(result)
        })
        // update rejected session's status to pending
        app.patch('/study-sessions/update/:id', verifyToken, verifyTutor, async (req, res) => {
            const id = req.params.id;
            const updateSession = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = { $set: { ...updateSession }, $unset: { rejection_info: '' } }
            const result = await studySessionColl.updateOne(query, updateDoc)
            res.send(result)
        })
        // update an study session
        app.patch('/api/tutor/study-sessions/update/:id', verifyToken, verifyTutor, async (req, res) => {
            const id = req.params.id;
            const updateSession = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = { $set: { ...updateSession } }
            const result = await studySessionColl.updateOne(query, updateDoc)
            res.send(result)
        })
        // delete a session from session coll.
        app.delete('/study-sessions/delete/:id', verifyToken, verifyTutor, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const checkResult = await studySessionColl.findOne(query, { projection: { status: 1 } })
            if (checkResult.status === 'approved') {
                return res.status(405).send({ message: 'Method Not Allowed' })
            }
            const result = await studySessionColl.deleteOne(query)
            res.send(result)
        })
        // get materials
        app.get('/api/tutor/materials/session/:id', verifyToken, verifyTutor, async (req, res) => {
            const id = req.params.id
            const query = { sessionId: id }
            const result = await materialColl.find(query).toArray()
            res.send(result)
        })
        // upload study materials
        app.post('/materials', verifyToken, verifyTutor, async (req, res) => {
            const materials = req.body
            const result = await materialColl.insertOne(materials)
            res.send(result)
        })
        // get all materials added by tutor
        app.get('/materials/tutor/:email', verifyToken, verifyTutor, async (req, res) => {
            const email = req.params?.email;
            let query = { tutor_email: email }
            const result = await materialColl.find(query).toArray()
            res.send(result)
        })
        // update a material in material coll.
        app.patch('/materials/update/:id', verifyToken, verifyTutor, async (req, res) => {
            const id = req.params.id;
            const material = req.body;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = { $set: { ...material } }
            const result = await materialColl.updateOne(filter, updateDoc)
            res.send(result)
        })
        // delete a material from material coll by tutor.
        app.delete('/materials/delete/:id', verifyToken, verifyTutor, async (req, res) => {
            const id = req.params.id
            const result = await materialColl.deleteOne({ _id: new ObjectId(id) })
            res.send(result)
        })
        // get total students
        app.get('/api/tutor/total-students/:email', verifyToken, verifyTutor, async (req, res) => {
            const email = req.params.email;
            const query = { tutor_email: email }
            const options = { projection: { userEmail: 1, _id: 0 } }
            const result = await bookingColl.find(query, options).toArray()
            res.send(result)
        })
        // get average ratings
        app.get('/api/tutor/ratings/:email', verifyToken, verifyTutor, async (req, res) => {
            const email = req.params.email;
            const pipeline = [
                {
                    $match: {
                        tutor_email: email,
                        status: 'approved',
                    },
                },
                {
                    $addFields: {
                        _idString: { $toString: '$_id' }
                    }
                },
                {
                    $lookup: {
                        from: 'reviews',
                        localField: '_idString',
                        foreignField: 'sessionId',
                        as: 'reviews'
                    }
                },
                {
                    $unwind: '$reviews'
                },
                {
                    $group: {
                        _id: null,
                        averageRating: { $avg: '$reviews.rating' }
                    }
                }
            ];
            const result = await studySessionColl.aggregate(pipeline).toArray()
            res.send(result)
        })
        // get total revenue
        app.get('/api/tutor/revenue/:email', verifyToken, verifyTutor, async (req, res) => {
            const email = req.params.email
            const pipeline = [
                {
                    $match: {
                        tutor_email: email,
                    }
                },
                {
                    $group: { _id: null, totalRevenue: { $sum: '$paymentInfo.amount' } }
                }
            ]
            const result = await bookingColl.aggregate(pipeline).toArray()
            const totalAmount = result[0].totalRevenue
            const revenue = totalAmount * 0.7
            res.send({ revenue })
        })


        // Admin related APIs
        // get all study session from db
        app.get('/study-sessions/by-admin', verifyToken, verifyAdmin, async (req, res) => {
            let limit = 0
            let query = {}
            let sort = { _id: -1 }
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
        app.patch('/study-sessions/update-by-admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updateSession = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = { $set: { ...updateSession } }
            const result = await studySessionColl.updateOne(query, updateDoc)
            res.send(result)
        })
        // delete an approved session by admin
        app.delete('/study-sessions/delete-by-admin/:id', verifyToken, verifyAdmin, async (req, res) => {
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
        app.patch('/study-session/update-by-admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateSession = req.body;
            const updateDoc = { $set: { ...updateSession } }
            const result = await studySessionColl.updateOne(query, updateDoc)
            res.send(result)
        })
        // get all materials from material collection
        app.get('/all-materials-admin', verifyToken, verifyAdmin, async (req, res) => {
            const result = await materialColl.find().toArray()
            res.send(result)
        })
        // delete materials by admin
        app.delete('/material/delete-by-admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await materialColl.deleteOne(query)
            res.send(result)
        })
        // update a material in material coll.
        app.patch('/materials/update-by-admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const material = req.body;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = { $set: { ...material } }
            const result = await materialColl.updateOne(filter, updateDoc)
            res.send(result)
        })
        // get all users
        app.get('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
            const searchText = req.query?.searchText;
            if (searchText && typeof searchText === 'string' && searchText.length > 1) {
                // console.log(searchText)
                const pipeline = [
                    { $match: { $text: { $search: searchText } } },
                    { $sort: { score: { $meta: "textScore" } } },
                ]
                // const query = { $text: { $search: searchText } }
                const result = await userColl.aggregate(pipeline).toArray()
                return res.send(result)
            }
            const result = await userColl.find().toArray()
            res.send(result)
        })
        // update a user's role
        app.patch('/api/admin/users/update-role/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const updateUser = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = { $set: { ...updateUser } }
            const result = await userColl.updateOne(query, updateDoc)
            res.send(result)
        })
        // search user
        app.get('/search-user', verifyToken, verifyAdmin, async (req, res) => {
            const searchText = req.query.searchText;
            const pipeline = [
                { $match: { $text: { $search: searchText } } },
                { $sort: { score: { $meta: "textScore" } } },
            ]
            // const query = { $text: { $search: searchText } }
            const result = await userColl.aggregate(pipeline).toArray()
            res.send(result)
        })
        // post announcement to db
        app.post('/api/admin/announcement', verifyToken, verifyAdmin, async (req, res) => {
            const announcement = req.body
            const result = await announcementColl.insertOne(announcement)
            res.send(result)
        })
        app.get('/api/admin/active-sessions', async (req, res) => {
            const query = { status: 'approved' }
            const options = { projection: { _id: 1 } }
            const result = await studySessionColl.find(query, options).toArray()
            res.send(result)
        })
        app.get('/api/admin/count-tutors', async (req, res) => {
            const query = { role: 'tutor' }
            const options = { projection: { email: 1, _id: 0 } }
            const result = await userColl.find(query, options).toArray()
            res.send(result)
        })
        app.get('/api/admin/count-students', async (req, res) => {
            const query = { role: 'student' }
            const options = { projection: { email: 1, _id: 0 } }
            const result = await userColl.find(query, options).toArray()
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

        // stripe payment api
        app.post('/create-payment-intent', async (req, res) => {
            const price = parseFloat(req.body?.price) * 100
            // Create a PaymentIntent with the order amount and currency
            const { client_secret } = await stripe.paymentIntents.create({
                amount: price,
                currency: 'usd',
                automatic_payment_methods: {
                    enabled: true,
                },
            });
            res.send({ clientSecret: client_secret })
        })



        // MUST REMOVE BEFORE DEPLOY
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.listen(port, () => {
    console.log(`TutorGalaxy app is listening on PORT: ${port}`)
})