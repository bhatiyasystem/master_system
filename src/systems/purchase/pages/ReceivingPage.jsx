
export default function ReceivingPage() {
    return (
        <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
            <PurchaseHeader subtitle="Confirm goods received against deliveries" />
            <ReceivingView />
        </div>
    );
}