import { create } from 'zustand';

const useDataStore = create((set) => ({
  indents: [],
  
  addIndent: (indentData) => {
    set((state) => ({
      indents: [...state.indents, indentData]
    }));
  },
  
  removeIndent: (indentId) => {
    set((state) => ({
      indents: state.indents.filter((indent) => indent.id !== indentId)
    }));
  },
  
  updateIndent: (indentId, updatedData) => {
    set((state) => ({
      indents: state.indents.map((indent) =>
        indent.id === indentId ? { ...indent, ...updatedData } : indent
      )
    }));
  },
  
  getIndents: () => {
    // This will be accessed via state selector
    return [];
  }
}));

export default useDataStore;
