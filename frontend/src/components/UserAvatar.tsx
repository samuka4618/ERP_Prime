import React from 'react';
import { User } from 'lucide-react';
import { User as UserType } from '../types';
import clsx from 'clsx';

interface UserAvatarProps {
  user?: UserType | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  iconClassName?: string;
  showFallback?: boolean;
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-16 h-16'
};

const iconSizeClasses = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  xl: 'w-8 h-8'
};

const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 'md',
  className = '',
  iconClassName = '',
  showFallback = true
}) => {
  const hasAvatar = user?.avatar && user.avatar.trim() !== '';
  const sizeClass = sizeClasses[size];
  const iconSizeClass = iconSizeClasses[size];

  if (hasAvatar) {
    return (
      <>
        <img
          src={`/${user.avatar}?v=${Date.now()}`}
          alt={user.name || 'Usuário'}
          className={clsx(
            sizeClass,
            'rounded-full object-cover',
            className
          )}
          onError={(e) => {
            // Se a imagem falhar ao carregar, mostrar fallback
            if (showFallback) {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }
          }}
        />
        {showFallback && (
          <div
            className={clsx(
              sizeClass,
              'rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center hidden',
              className
            )}
          >
            <User className={clsx('text-white', iconSizeClass, iconClassName)} />
          </div>
        )}
      </>
    );
  }

  if (!showFallback) {
    return null;
  }

  return (
    <div
      className={clsx(
        sizeClass,
        'rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center',
        className
      )}
    >
      <User className={clsx('text-white', iconSizeClass, iconClassName)} />
    </div>
  );
};

export default UserAvatar;

