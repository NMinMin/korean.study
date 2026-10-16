// The tracker acknowledges the event synchronously and settles after its writes.
export function saveStudySessionTime() {
  return new Promise((resolve, reject) => {
    const event = new CustomEvent('kstudy:study-session-completed', {
      cancelable: true,
      detail: { resolve, reject },
    });
    window.dispatchEvent(event);
    if (!event.defaultPrevented) reject(new Error('Chưa sẵn sàng ghi thời gian học.'));
  });
}
