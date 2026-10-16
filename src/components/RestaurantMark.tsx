import type { Restaurant } from '@/data';

type Props = {
  restaurant: Restaurant;
  className?: string;
};

export function RestaurantMark({ restaurant, className = 'restaurant-emblem' }: Props) {
  return (
    <div className={className}>
      {restaurant.logoUrl ? <img src={restaurant.logoUrl} alt={`${restaurant.name} logo`} /> : restaurant.logo}
    </div>
  );
}
