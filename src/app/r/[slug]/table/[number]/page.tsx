'use client';
import { RestaurantMenu } from '@/features/menu/RestaurantMenu';
export default function TableMenuPage({params}:{params:{slug:string;number:string}}){return <RestaurantMenu restaurantSlug={params.slug} tableNumber={params.number}/>}
