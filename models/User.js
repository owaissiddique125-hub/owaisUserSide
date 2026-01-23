const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  clerkId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  profileImage: {
    type: String,
    default: 'https://www.w3schools.com/howto/img_avatar.png'
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    formatted: String
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for better query performance
userSchema.index({ clerkId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ location: '2dsphere' }); // For geospatial queries

// Method to get public user data (exclude sensitive info)
userSchema.methods.toPublicJSON = function() {
  return {
    id: this.clerkId,
    email: this.email,
    name: this.name,
    phoneNumber: this.phoneNumber,
    profileImage: this.profileImage,
    address: this.address,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
