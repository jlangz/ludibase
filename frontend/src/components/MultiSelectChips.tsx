interface Option {
  readonly value: string
  readonly label: string
}

interface MultiSelectChipsProps {
  options: readonly Option[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function MultiSelectChips({ options, selected, onChange }: MultiSelectChipsProps) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              isSelected
                ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
