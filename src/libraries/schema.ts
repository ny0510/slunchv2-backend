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
      origin: { type: String, required: false }
    }
  ],
  calorie: { type: String, required: true },
  nutrition: [
    {
      type: { type: String, required: true },
      amount: { type: String, required: true }
    }
  ],
  school_code: String,
  region_code: String
});

const postSchema = new db.Schema({
  date: Date,
  title: String,
  content: String
})

export const MealSchema = db.model('Meal', mealSchema);
export type MealSchema = db.InferSchemaType<typeof mealSchema>;
export const PostSchema = db.model('Post', postSchema);
export type PostSchema = db.InferSchemaType<typeof postSchema>;

