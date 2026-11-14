import type { CompanyView } from "@netcity/shared";
export function CompanyPanel({company,track}: {company:CompanyView;track:(id:string)=>void}) {
  const done=company.contract.steps.filter(step=>step.completed).length;
  return <section className="company-card" aria-label="Моя IT-бригада">
    <div className="eyebrow">АУТСОРСИНГ · ПЕРВЫЙ КОНТРАКТ</div><h3>{company.name}</h3>
    <p>Репутация: <strong data-testid="reputation">{company.reputation}</strong> · Одиночная бригада</p>
    <h4>{company.contract.title}</h4><p>Восстановите общую сеть и проведите диагностику трёх рабочих мест.</p>
    <progress aria-label="Прогресс контракта" value={done} max={company.contract.steps.length}/>
    <ul>{company.contract.steps.map(step=><li key={step.id}>
      <span>{step.completed?"✓":"○"} {step.title}</span>{!step.completed && <button onClick={()=>track(step.id)}>К заявке №{step.id}</button>}
    </li>)}</ul>
    <p role="status">{company.contract.completed?"Контракт выполнен · репутация +1":"Завершите этапы, чтобы получить первую единицу репутации."}</p>
    <small>За этапы начисляются обычные награды заявок. Дополнительных денег за контракт нет. Приглашения в компанию и командные бюджеты появятся в следующих этапах.</small>
  </section>;
}
