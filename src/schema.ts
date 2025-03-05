import * as db from 'mongoose';

const mealSchema = new db.Schema({
	date: String,
	meal: [String],
	type: String,
	origin: [{ food: String, origin: String }],
	calorie: String,
	nutrition: String,
});

export type MealSchema = db.InferSchemaType<typeof mealSchema>;
export const MealSchema = new db.Model('Meal', mealSchema);
