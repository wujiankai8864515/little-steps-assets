import React from 'react';
import * as Select from '@radix-ui/react-select';
import * as Dialog from '@radix-ui/react-dialog';
import * as Progress from '@radix-ui/react-progress';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';

// Select composition adapted from shadcn/ui (MIT); see docs/licenses/shadcn.txt.
// Styling stays local so this JavaScript app does not need a Tailwind migration.
export function SelectField({ value, onChange, options, placeholder='请选择', label, id, disabled=false, className='' }) {
  return <Select.Root value={String(value ?? '')} onValueChange={onChange} disabled={disabled || !options.length}>
    <Select.Trigger id={id} aria-label={label} className={'ui-select '+className}>
      <Select.Value placeholder={placeholder}/><Select.Icon asChild><ChevronDown size={16}/></Select.Icon>
    </Select.Trigger>
    <Select.Portal><Select.Content className="ui-select-content" position="popper" sideOffset={6} collisionPadding={12}>
      <Select.ScrollUpButton className="ui-select-scroll"><ChevronUp size={16}/></Select.ScrollUpButton>
      <Select.Viewport className="ui-select-viewport">{options.map(o => <Select.Item key={o.value} value={String(o.value)} className="ui-select-item" textValue={o.label}>
        <Select.ItemText>{o.label}</Select.ItemText>
        <Select.ItemIndicator className="ui-select-check"><Check size={15}/></Select.ItemIndicator>
      </Select.Item>)}</Select.Viewport>
      <Select.ScrollDownButton className="ui-select-scroll"><ChevronDown size={16}/></Select.ScrollDownButton>
    </Select.Content></Select.Portal>
  </Select.Root>;
}

export function Segmented({ value, onChange, items, label }) {
  return <ToggleGroup.Root type="single" className="segmented" value={value} onValueChange={v=>v&&onChange(v)} aria-label={label}>
    {items.map(item=><ToggleGroup.Item key={item} value={item}>{item}</ToggleGroup.Item>)}
  </ToggleGroup.Root>;
}

export function ProgressBar({ value, label }) {
  return <Progress.Root className="progress-track" value={value} aria-label={label}>
    <Progress.Indicator className={value===null?'indeterminate':''} style={value===null?undefined:{transform:`translateX(-${100-value}%)`}}/>
  </Progress.Root>;
}

export function Drawer({ open, onOpenChange, children, title='资源管理', description='查看资源详情和制作记录。', className='' }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal><Dialog.Overlay className="ui-overlay"/><Dialog.Content className={'ui-drawer '+className}>
      <header><Dialog.Title>{title}</Dialog.Title><Dialog.Close asChild><button className="icon-button" aria-label={'关闭'+title}><X size={20}/></button></Dialog.Close></header>
      <Dialog.Description className="muted drawer-description">{description}</Dialog.Description>
      {children}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}

export function Tip({ children, text }) {
  return <Tooltip.Root><Tooltip.Trigger asChild>{children}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="ui-tooltip" sideOffset={7}>{text}<Tooltip.Arrow/></Tooltip.Content></Tooltip.Portal></Tooltip.Root>;
}
export const TooltipProvider=Tooltip.Provider;
