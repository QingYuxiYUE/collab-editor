import React, { useEffect, useState } from 'react';

interface UserInfo {
  name: string;
  color: string;
}

interface AwarenessLike {
  getStates(): Map<number, unknown>;
  on(event: 'change', handler: () => void): void;
  off(event: 'change', handler: () => void): void;
}

interface UserPresenceProps {
  awareness: AwarenessLike | null;
}

function isUserInfo(value: unknown): value is UserInfo {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as UserInfo).name === 'string' &&
    typeof (value as UserInfo).color === 'string'
  );
}

/**
 * Displays avatars of currently connected collaborators
 */
const UserPresence: React.FC<UserPresenceProps> = ({ awareness }) => {
  const [users, setUsers] = useState<UserInfo[]>([]);

  useEffect(() => {
    if (!awareness) return;

    const updateUsers = () => {
      const states = Array.from(awareness.getStates().values());
      const onlineUsers = states
        .map((state) =>
          typeof state === 'object' && state !== null
            ? (state as Record<string, unknown>).data
            : null,
        )
        .filter(isUserInfo);
      setUsers(onlineUsers);
    };

    awareness.on('change', updateUsers);
    updateUsers();

    return () => {
      awareness.off('change', updateUsers);
    };
  }, [awareness]);

  if (users.length === 0) return null;

  return (
    <div className="user-presence">
      {users.slice(0, 5).map((user, i) => (
        <div
          key={i}
          className="user-presence__avatar"
          style={{ backgroundColor: user.color }}
          title={user.name}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
      ))}
      {users.length > 5 && (
        <span className="user-presence__count">+{users.length - 5}</span>
      )}
    </div>
  );
};

export default UserPresence;
