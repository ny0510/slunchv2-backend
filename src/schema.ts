import * as db from 'mongoose';

const mealSchema = new db.Schema({
	date: String,
	meal: [String],
	type: String,
	origin: [{ food: String, origin: String }],
	calorie: String,
	nutrition: [{ type: { type: String, required: true }, amount: { type: String, required: true } }],
});

export type MealSchema = db.InferSchemaType<typeof mealSchema>;
export const MealSchema = db.model('Meal', mealSchema);
