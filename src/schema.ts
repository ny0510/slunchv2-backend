import * as db from 'mongoose';

const mealSchema = new db.Schema({
  date: { type: String, required: true },
  meal: [
    {
      food: { type: String, required: true },
      allergy: [
        {
          type: { type: String, required: true },
          code: { type: String, required: true }
        }
      ]
    }
  ],
  type: { type: String, required: true },
  origin: [
    {
      food: { type: String, required: true },
      origin: { type: String, required: true }
    }
  ],
  calorie: { type: String, required: true },
  nutrition: [
    {
      type: { type: String, required: true },
      amount: { type: String, required: true }
    }
  ]
});

export const MealSchema = db.model('Meal', mealSchema);
export type MealSchema = db.InferSchemaType<typeof mealSchema>;

