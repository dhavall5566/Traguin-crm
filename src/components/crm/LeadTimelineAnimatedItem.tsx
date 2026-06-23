import React from 'react';

type LeadTimelineAnimatedItemProps = {
  animate: boolean;
  className: string;
  children: React.ReactNode;
  as?: 'article' | 'div';
};

export function LeadTimelineAnimatedItem({
  animate,
  className,
  children,
  as: Tag = 'article',
}: LeadTimelineAnimatedItemProps) {
  return (
    <Tag
      className={['crm-timeline-item', animate ? 'crm-timeline-item--enter' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  );
}
