import PurchaseHeader from "../components/PurchaseHeader";
import PaymentView from "../components/PaymentView";

export default function PaymentPage() {
    return (
        <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
            <PurchaseHeader subtitle="Record payments against approved purchase orders" />
            <PaymentView />
        </div>
    );
}