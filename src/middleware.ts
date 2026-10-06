import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const path=request.nextUrl.pathname;
  if(path==='/admin') return NextResponse.redirect(new URL('/restaurant/menu',request.url));
  if(!url||!key) return NextResponse.next();

  let response=NextResponse.next({request});
  const supabase=createServerClient(url,key,{
    cookies:{
      getAll:()=>request.cookies.getAll(),
      setAll:(cookiesToSet)=>{
        cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));
        response=NextResponse.next({request});
        cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
      },
    },
  });
  const {data:{user}}=await supabase.auth.getUser();

  const isRestaurant=path.startsWith('/restaurant/')&&!path.startsWith('/restaurant/login');
  const isPlatform=path.startsWith('/platform/')&&!path.startsWith('/platform/login');
  if(isRestaurant&&!user) return NextResponse.redirect(new URL('/restaurant/login',request.url));
  if(isPlatform&&!user) return NextResponse.redirect(new URL('/platform/login',request.url));

  if(user&&isRestaurant){
    const {data:membership}=await supabase.from('restaurant_members').select('restaurant_id').eq('user_id',user.id).limit(1).maybeSingle();
    if(!membership) return NextResponse.redirect(new URL('/register?status=no-workspace',request.url));
  }
  if(user&&isPlatform){
    const {data:isAdmin}=await supabase.rpc('is_platform_admin');
    if(!isAdmin) return NextResponse.redirect(new URL('/platform/login?error=not-admin',request.url));
  }
  return response;
}

export const config={matcher:['/restaurant/:path*','/platform/:path*','/admin']};
