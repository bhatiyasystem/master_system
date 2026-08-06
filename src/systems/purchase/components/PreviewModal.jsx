import Modal from './Modal';
import POSheet from './POSheet'

export default function PreviewModal({ po, revisionNote, onClose }) {
  return (
    <Modal
      open={!!po}
      onClose={onClose}
      title="Purchase Order Preview"
      size="xl"
      footer={
        <>
          <button className="rounded-lg border border-[#173254] px-4 py-2 text-sm font-semibold text-[#173254]" onClick={onClose}>
            Close
          </button>
          <button className="rounded-lg bg-[#173254] px-4 py-2 text-sm font-semibold text-white" onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </>
      }
    >
      {po && (
        <div className="bg-[#EEF1F6] p-4" id="po-print-area">
          <POSheet po={po} revisionNote={revisionNote} />
        </div>
      )}
    </Modal>
  );
}
