export interface InstagramProfile {
  name: string | null;
  username: string | null;
  profile_pic: string | null;
  follower_count: number | null;
  is_user_follow_business: boolean | null;
  is_business_follow_user: boolean | null;
}

class InstagramAPIError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`Instagram API error: ${status}`);
  }
}

export async function fetchInstagramProfile(igsid: string): Promise<InstagramProfile> {
  const url = new URL(`https://graph.instagram.com/v24.0/${igsid}`);
  url.searchParams.set("fields", "name,username,profile_pic,follower_count,is_user_follow_business,is_business_follow_user");
  url.searchParams.set("access_token", process.env.INSTAGRAM_ACCESS_TOKEN!);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok) throw new InstagramAPIError(res.status, data);

  return {
    name: data.name ?? null,
    username: data.username ?? null,
    profile_pic: data.profile_pic ?? null,
    follower_count: data.follower_count ?? null,
    is_user_follow_business: data.is_user_follow_business ?? null,
    is_business_follow_user: data.is_business_follow_user ?? null,
  };
}

export async function sendInstagramMessage(recipientIgsid: string, text: string) {
  const url = new URL("https://graph.instagram.com/v24.0/me/messages");
  url.searchParams.set("access_token", process.env.INSTAGRAM_ACCESS_TOKEN!);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientIgsid },
      message: { text },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new InstagramAPIError(res.status, data);
  return data;
}
