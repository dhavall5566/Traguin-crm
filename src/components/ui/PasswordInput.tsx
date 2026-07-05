'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  variant?: 'default' | 'login';
};

export function PasswordInput({
  id,
  className = '',
  variant = 'default',
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  const inputClassName = [
    variant === 'login' ? 'crm-login-input crm-password-field__input' : 'crm-password-field__input',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="crm-password-field">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className={inputClassName}
        {...props}
      />
      <button
        type="button"
        className="crm-password-field__toggle"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
      </button>
    </div>
  );
}
