import { supabase } from '../../lib/supabase';

export async function computeLeaderboard(profile, textbookId = null, page = 1, pageSize = 10) {
  try {
    if (!supabase) throw new Error('Supabase chưa được cấu hình');

    // Thử gọi RPC get_curriculum_leaderboard
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_curriculum_leaderboard', {
        p_textbook_id: textbookId || null,
        p_page: page,
        p_page_size: pageSize,
      });
      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        const rows = rpcData.map((item) => ({
          rank: Number(item.rank_position),
          userId: item.user_id,
          displayName: item.display_name || 'Người học',
          xp: Number(item.xp || 0),
          streak: Number(item.streak || 0),
          updatedAt: new Date(item.updated_at).getTime(),
        }));
        const total = rpcData[0]?.total_count != null ? Number(rpcData[0].total_count) : rows.length;
        const myRank = rpcData[0]?.my_rank != null ? Number(rpcData[0].my_rank) : null;
        return { rows, myRank, total };
      }
    } catch (rpcErr) { }

    // Fallback query trực tiếp nếu chưa chạy RPC hoặc RPC trả rỗng
    if (textbookId) {
      const { data, count, error } = await supabase
        .from('curriculum_leaderboard_stats')
        .select('user_id, xp, streak, updated_at, profiles!curriculum_leaderboard_stats_user_id_fkey(display_name)', { count: 'exact' })
        .eq('textbook_id', textbookId)
        .gt('xp', 0)
        .order('xp', { ascending: false })
        .order('streak', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw error;
      const rows = (data || []).map((item, idx) => ({
        rank: (page - 1) * pageSize + idx + 1,
        userId: item.user_id,
        displayName: item.profiles?.display_name || 'Người học',
        xp: item.xp,
        streak: item.streak,
        updatedAt: new Date(item.updated_at).getTime(),
      }));
      return { rows, myRank: null, total: count || rows.length };
    }

    const { data, count, error } = await supabase
      .from('leaderboard_stats')
      .select('user_id, xp, streak, updated_at, profiles!leaderboard_stats_user_id_fkey(display_name)', { count: 'exact' })
      .gt('xp', 0)
      .order('xp', { ascending: false })
      .order('streak', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw error;
    const rows = (data || []).map((item, idx) => ({
      rank: (page - 1) * pageSize + idx + 1,
      userId: item.user_id,
      displayName: item.profiles?.display_name || 'Người học',
      xp: item.xp,
      streak: item.streak,
      updatedAt: new Date(item.updated_at).getTime(),
    }));
    return { rows, myRank: null, total: count || rows.length };
  } catch (e) {
    return { rows: [], myRank: null, total: 0 };
  }
}
