function FormSelect({
    name,
    options,
    required = false,
  }) {
    return (
      <select
        name={name}
        required={required}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  
  export default FormSelect;