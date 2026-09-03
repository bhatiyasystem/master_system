import { useEffect, useState } from 'react';
import systemRegistry from '../../core/registry/systemRegistry';
import { initializeStorage } from './src/utils/storageManager';

// Import NewPete pages
import AdminDashboard from './src/pages/AdminDashboard';
import AddCash from './src/pages/AddCash';
import Expenses from './src/pages/Expenses';
import Settings from './src/pages/Settings';
import Ledger from './src/pages/Ledger';

function NewPeteWrapper({ Component }) {
    const [syncing, setSyncing] = useState(true);

    useEffect(() => {
        let active = true;
        initializeStorage().then(() => {
            if (active) setSyncing(false);
        }).catch(err => {
            console.error("Storage initialization failed:", err);
            if (active) setSyncing(false);
        });
        return () => {
            active = false;
        };
    }, []);

    if (syncing) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-semibold text-gray-500">Syncing petty cash database...</span>
                </div>
            </div>
        );
    }

    return <Component />;
}

systemRegistry.register({
    id: 'newpete',
    name: 'Petty Cash',
    icon: 'FolderKanban',
    menuItems: [
        {
            label: 'Dashboard',
            href: '/dashboard/newpete',
            icon: 'LayoutDashboard',
            showFor: ['admin', 'HOD', 'user']
        },
        {
            label: 'Add Cash',
            href: '/dashboard/newpete-add-cash',
            icon: 'PlusCircle',
            showFor: ['admin', 'HOD', 'user']
        },
        {
            label: 'Expenses',
            href: '/dashboard/newpete-expenses',
            icon: 'DollarSign',
            showFor: ['admin', 'HOD', 'user']
        },
        {
            label: 'Ledger',
            href: '/dashboard/newpete-ledger',
            icon: 'BookOpen',
            showFor: ['admin', 'HOD', 'user']
        },
        // {
        //     label: 'Settings',
        //     href: '/dashboard/newpete-settings',
        //     icon: 'Settings',
        //     showFor: ['admin', 'HOD', 'user]
        // }
    ],
    routes: [
        {
            path: '/dashboard/newpete',
            element: <NewPeteWrapper Component={AdminDashboard} />,
            protected: true
        },
        {
            path: '/dashboard/newpete-add-cash',
            element: <NewPeteWrapper Component={AddCash} />,
            protected: true
        },
        {
            path: '/dashboard/newpete-expenses',
            element: <NewPeteWrapper Component={Expenses} />,
            protected: true
        },
        {
            path: '/dashboard/newpete-ledger',
            element: <NewPeteWrapper Component={Ledger} />,
            protected: true
        },
        // {
        //     path: '/dashboard/newpete-settings',
        //     element: <NewPeteWrapper Component={Settings} />,
        //     protected: true
        // }
    ]
});