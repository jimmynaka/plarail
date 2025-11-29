// Cloudflare Bindings
export type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
};

// User
export type User = {
  id: number;
  username: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  plarail_history?: string;
  specialty_tags?: string; // JSON
  owned_trains?: string; // JSON
  social_links?: string; // JSON
  is_official: boolean;
  created_at: string;
  updated_at: string;
};

// Post
export type Post = {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  category: string;
  visibility: 'public' | 'followers' | 'private';
  images: string; // JSON
  tags?: string; // JSON
  like_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
};

// Question
export type Question = {
  id: number;
  user_id: number;
  title: string;
  content: string;
  category: string;
  difficulty?: string;
  status: 'open' | 'solved' | 'closed';
  images?: string; // JSON
  tags?: string; // JSON
  answer_count: number;
  view_count: number;
  best_answer_id?: number;
  created_at: string;
  updated_at: string;
};

// Answer
export type Answer = {
  id: number;
  question_id: number;
  user_id: number;
  content: string;
  images?: string; // JSON
  like_count: number;
  is_best_answer: boolean;
  created_at: string;
  updated_at: string;
};

// Announcement
export type Announcement = {
  id: number;
  user_id: number;
  title: string;
  product_name: string;
  product_code?: string;
  price?: number;
  release_date?: string;
  description?: string;
  images?: string; // JSON
  video_url?: string;
  official_url?: string;
  category?: string;
  like_count: number;
  comment_count: number;
  notify_on_release: boolean;
  created_at: string;
  updated_at: string;
};

// Request
export type Request = {
  id: number;
  user_id: number;
  title: string;
  description: string;
  category: string;
  images?: string; // JSON
  status: 'pending' | 'confirmed' | 'in_review' | 'planned' | 'rejected';
  support_count: number;
  manufacturer_response?: string;
  created_at: string;
  updated_at: string;
};

// Like
export type Like = {
  id: number;
  user_id: number;
  target_type: 'post' | 'question' | 'answer' | 'announcement';
  target_id: number;
  created_at: string;
};

// Follow
export type Follow = {
  id: number;
  follower_id: number;
  following_id: number;
  created_at: string;
};

// Comment
export type Comment = {
  id: number;
  user_id: number;
  announcement_id: number;
  content: string;
  created_at: string;
};
