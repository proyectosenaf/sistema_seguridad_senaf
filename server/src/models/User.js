import mongoose from 'mongoose';


const userSchema = new mongoose.Schema({
sub: { type: String, index: true, unique: true, required: true }, // Auth0 subject
email: { type: String, index: true },
nombre: String,
roles: { type: [String], default: [] }, // p.ej. ['admin','guardia']
}, { timestamps: true });


export default mongoose.model('User', userSchema);