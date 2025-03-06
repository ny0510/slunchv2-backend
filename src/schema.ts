import * as db from 'mongoose';

const mealSchema = new db.Schema({
	date: String,
	meal: [String],
	type: String,
	origin: [{ food: String, origin: String }],
	calorie: String,
	nutrition: [{ type: String, amount: String }],
});

export type MealSchema = db.InferSchemaType<typeof mealSchema>;
export const MealSchema = db.model('Meal', mealSchema);
