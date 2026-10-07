import { useEffect, useRef, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const fallback = previous?.closest<HTMLElement>('[data-focus-return]');
    const dialog = ref.current!;
    dialog.showModal();
    // 原生 dialog 限制焦点在弹窗内，关闭后回到原触发按钮，键盘流程不会丢失。
    return () => {
      dialog.close();
      // 连接成功时原按钮会替换成“断开”，返回稳定容器内的新按钮，避免跳到页首。
      if (previous?.isConnected) previous.focus();
      else fallback?.querySelector<HTMLElement>('button')?.focus();
    };
  }, []);
  // 对话框挂到 body，避免仓库连接表单嵌套在收藏表单内。
  return createPortal(
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        // 显式循环首尾焦点，避免部分浏览器把最后一次 Tab 移到地址栏。
        const items = Array.from(
          ref.current!.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      aria-labelledby={titleId}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" aria-label="关闭对话框" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
