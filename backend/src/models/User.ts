import mongoose, { Schema, Document } from 'mongoose';
import { Roles, type Role } from '@gsp/shared';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  agentOrgId?: string;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: Object.values(Roles) },
    agentOrgId: { type: String },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
