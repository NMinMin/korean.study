import { supabase } from './supabase'

export type StorePlant = {
  id: string
  name: string
  description: string
  price: number
  sort_order: number
  owned: boolean
  selected: boolean
}

export type ShopState = {
  balance: number
  selectedPlant: string
  plants: StorePlant[]
}

export async function loadShopState(): Promise<ShopState> {
  const { data, error } = await supabase.rpc('get_my_plant_shop')
  if (error) throw error
  const value = data as { balance?: number; selected_plant?: string; plants?: StorePlant[] } | null
  return {
    balance: Number(value?.balance || 0),
    selectedPlant: value?.selected_plant || 'mugunghwa',
    plants: value?.plants || [],
  }
}

export async function awardLessonGems(textbookId: string, lessonId: string) {
  const { data, error } = await supabase.rpc('award_lesson_gems', {
    p_textbook_id: String(textbookId),
    p_lesson_id: String(lessonId),
  })
  if (error) throw error
  return data as { awarded: boolean; amount: number; balance: number }
}

export async function purchasePlant(plantId: string) {
  const { data, error } = await supabase.rpc('purchase_plant', { p_plant_id: plantId })
  if (error) throw error
  return data as { purchased: boolean; balance: number }
}

export async function selectPlant(plantId: string) {
  const { data, error } = await supabase.rpc('select_plant', { p_plant_id: plantId })
  if (error) throw error
  return data as { selected_plant: string }
}
